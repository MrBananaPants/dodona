class DiffCsv
  require 'builder'

  def self.render_accepted(builder, generated)
    generated = CSV.parse((generated || '').lstrip, nil_value: '')
    gen_headers, *generated = generated

    return if gen_headers.blank?

    builder.div(class: 'diffs show-unified') do
      builder.table(class: 'unified-diff diff csv-diff') do
        builder.colgroup do
          builder.col(class: 'line-nr')
          builder.col(class: 'del-output-csv', span: gen_headers.length)
        end
        builder.thead do
          builder.tr do
            builder << "<th class='line-nr'></th>"
            builder << gen_headers.map { |el| %(<th>#{CGI.escape_html el}</th>) }.join
          end
        end
        builder.tbody do
          generated.each.with_index do |line, idx|
            builder.tr do
              builder << %(<td class="line-nr">#{idx + 1}</td>)
              builder << line.map { |el| %(<td>#{CGI.escape_html el || ''}</td>) }.join
            end
          end
        end
      end
    end
  end

  def initialize(generated, expected)
    @generated = CSV.parse((generated || '').lstrip, nil_value: '')
    @expected = CSV.parse((expected || '').lstrip, nil_value: '')

    @gen_headers, *@generated = @generated
    @gen_headers ||= []
    @exp_headers, *@expected = @expected
    @exp_headers ||= []

    @generated_rowcount = @generated.length
    @expected_rowcount = @expected.length
    @simplified_table = @generated_rowcount > 100 || @expected_rowcount > 100

    @gen_header_indices, @exp_header_indices, @gen_headers, @exp_headers, @combined_headers = diff_header_indices(@gen_headers, @exp_headers)

    @diff = unless @simplified_table
              Diff::LCS.sdiff(@generated, @expected).map do |chunk|
                gen_result = chunk.old_element || []
                exp_result = chunk.new_element || []
                if chunk.action == '!'
                  gen_result, exp_result = diff_arrays(gen_result, exp_result)
                else
                  gen_result = gen_result.map { |el| CGI.escape_html el }
                  exp_result = exp_result.map { |el| CGI.escape_html el }
                end
                Diff::LCS::ContextChange.new(chunk.action, chunk.old_position, gen_result, chunk.new_position, exp_result)
              end
            end
  end

  def unified
    builder = Builder::XmlMarkup.new
    builder.table(class: 'unified-diff diff csv-diff') do
      builder.colgroup do
        builder.col(class: 'line-nr')
        builder.col(class: 'line-nr')
        builder.col(class: 'output-csv', span: @combined_headers.length)
      end
      builder.thead do
        builder.tr do
          builder << "<th class='line-nr' title='#{I18n.t('submissions.show.your_output')}'><i class='mdi mdi-18 mdi-file-account'/></th>"
          builder << "<th class='line-nr' title='#{I18n.t('submissions.show.expected')}'><i class='mdi mdi-18 mdi-file-check'/></th>"
          builder << "<th colspan='#{@combined_headers.length}'>#{I18n.t('submissions.show.your_output')}</th>"
        end
        builder.tr do
          builder << "<th class='line-nr'></th>"
          builder << "<th class='line-nr'></th>"
          builder << @combined_headers.join
        end
      end
      builder.tbody do
        if @simplified_table
          unified_simple builder
        else
          @diff.each do |chunk|
            is_empty, row = old_row chunk

            unless is_empty
              full_row = Array.new(@combined_headers.length) { |i| @gen_header_indices.index(i) }.map { |idx| idx.nil? ? '<td></td>' : row[idx] }

              builder << %(<tr>
              <td class="line-nr">#{chunk.old_position + 1}</td>
              <td class="line-nr"></td>
              #{full_row.join}
            </tr>)
            end

            is_empty, row = new_row chunk

            next if is_empty

            full_row = Array.new(@combined_headers.length) { |i| @exp_header_indices.index(i) }.map { |idx| idx.nil? ? '<td></td>' : row[idx] }

            builder << %(<tr>
              <td class="line-nr"></td>
              <td class="line-nr">#{chunk.new_position + 1}</td>
              #{full_row.join}
            </tr>)
          end
        end
      end
    end.html_safe
  end

  def split
    builder = Builder::XmlMarkup.new

    builder.div do
      split_build_table(builder, @gen_headers, true)
      split_build_table(builder, @exp_headers, false)
    end.html_safe
  end

  private

  def split_build_table(builder, headers, is_old)
    builder.table(class: 'split-diff diff csv-diff') do
      if is_old
        cls = 'del-output-csv'
        icon_cls = 'mdi-file-account'
        title = I18n.t('submissions.show.your_output')
      else
        cls = 'ins-output-csv'
        icon_cls = 'mdi-file-check'
        title = I18n.t('submissions.show.expected')
      end

      builder.colgroup do
        builder.col(class: 'line-nr')
        builder.col(class: cls, span: headers.length)
      end
      builder.thead do
        builder.tr do
          builder << "<th class='line-nr' title='#{title}'><i class='mdi mdi-18 #{icon_cls}'/></th>"
          builder << "<th colspan='#{headers.length}'>#{title}</th>"
        end
        builder.tr do
          builder << "<th class='line-nr'></th>"
          builder << headers.join
        end
      end
      builder.tbody do
        if @simplified_table
          if is_old
            simple_old_row(builder)
          else
            simple_new_row(builder)
          end
        else
          @diff.each do |chunk|
            builder.tr do
              if is_old
                is_empty, row = old_row(chunk)
                position = chunk.old_position
              else
                is_empty, row = new_row(chunk)
                position = chunk.new_position
              end
              builder << %(<td class="line-nr">#{position + 1 unless is_empty}</td>)
              builder << row.join
            end
          end
        end
      end
    end
  end

  def unified_simple(builder)
    gen_cols = @generated.transpose.map { |col| col.join("\n") }
    builder.tr do
      builder.td(class: 'line-nr') do
        builder << (1..@generated_rowcount).to_a.join("\n")
      end
      builder.td(class: 'line-nr')

      builder << Array.new(@combined_headers.length) { |i| @gen_header_indices.index(i) }.map do |idx|
        if idx.nil?
          '<td></td>'
        else
          %(<td class="del">#{CGI.escape_html gen_cols[idx]}</td>)
        end
      end.join
    end

    exp_cols = @expected.transpose.map { |col| col.join("\n") }
    builder.tr do
      builder.td(class: 'line-nr')
      builder.td(class: 'line-nr') do
        builder << (1..@expected_rowcount).to_a.join("\n")
      end

      builder << Array.new(@combined_headers.length) { |i| @exp_header_indices.index(i) }.map do |idx|
        if idx.nil?
          '<td></td>'
        else
          %(<td class="ins">#{CGI.escape_html exp_cols[idx]}</td>)
        end
      end.join
    end
  end

  def simple_old_row(builder)
    gen_cols = @generated.transpose.map { |col| col.join("\n") }

    builder.tr do
      builder.td(class: 'line-nr') do
        builder << (1..@generated_rowcount).to_a.join("\n")
      end
      gen_cols.each do |col|
        builder.td(class: 'del') do
          builder << CGI.escape_html(col)
        end
      end
    end
  end

  def simple_new_row(builder)
    exp_cols = @expected.transpose.map { |col| col.join("\n") }

    builder.tr do
      builder.td(class: 'line-nr') do
        builder << (1..@expected_rowcount).to_a.join("\n")
      end
      exp_cols.each do |col|
        builder.td(class: 'ins') do
          builder << CGI.escape_html(col)
        end
      end
    end
  end

  def old_row(chunk)
    old_class = {
      '-' => 'del',
      '+' => '',
      '=' => 'unchanged',
      '!' => 'del'
    }[chunk.action]
    [old_class.empty?, chunk.old_element.map { |el| %(<td class="#{old_class}">#{el}</td>) }]
  end

  def new_row(chunk)
    new_class = {
      '-' => '',
      '+' => 'ins',
      '=' => 'unchanged',
      '!' => 'ins'
    }[chunk.action]
    [new_class.empty?, chunk.new_element.map { |el| %(<td class="#{new_class}">#{el}</td>) }]
  end

  def diff_arrays(generated, expected)
    gen_result = []
    exp_result = []
    Diff::LCS.sdiff(generated, expected) do |chunk|
      case chunk.action
      when '-'
        gen_result << %(<strong>#{CGI.escape_html chunk.old_element}</strong>)
      when '+'
        exp_result << %(<strong>#{CGI.escape_html chunk.new_element}</strong>)
      when '='
        gen_result << (CGI.escape_html chunk.old_element)
        exp_result << (CGI.escape_html chunk.new_element)
      when '!'
        gen_result << %(<strong>#{CGI.escape_html chunk.old_element}</strong>)
        exp_result << %(<strong>#{CGI.escape_html chunk.new_element}</strong>)
      end
    end
    [gen_result, exp_result]
  end

  def diff_header_indices(generated, expected)
    counter = 0
    gen_indices = []
    exp_indices = []

    gen_headers = []
    exp_headers = []

    combined_headers = []

    Diff::LCS.sdiff(generated, expected) do |chunk|
      case chunk.action
      when '-'
        gen_indices << counter
        counter += 1
        gen_headers << %(<th class="del"><strong>#{CGI.escape_html chunk.old_element}</strong></th>)
        combined_headers << %(<th class="del"><strong>#{CGI.escape_html chunk.old_element}</strong></th>)
      when '+'
        exp_indices << counter
        counter += 1
        exp_headers << %(<th class="ins"><strong>#{CGI.escape_html chunk.new_element}</strong></th>)
        combined_headers << %(<th class="ins"><strong>#{CGI.escape_html chunk.new_element}</strong></th>)
      when '='
        gen_indices << counter
        exp_indices << counter
        counter += 1
        gen_headers << %(<th>#{CGI.escape_html chunk.old_element}</th>)
        exp_headers << %(<th>#{CGI.escape_html chunk.new_element}</th>)
        combined_headers << %(<th>#{CGI.escape_html chunk.new_element}</th>)
      when '!'
        gen_indices << counter
        counter += 1
        gen_headers << %(<th class="del"><strong>#{CGI.escape_html chunk.old_element}</strong></th>)
        combined_headers << %(<th class="del"><strong>#{CGI.escape_html chunk.old_element}</strong></th>)

        exp_indices << counter
        counter += 1
        exp_headers << %(<th class="ins"><strong>#{CGI.escape_html chunk.new_element}</strong></th>)
        combined_headers << %(<th class="ins"><strong>#{CGI.escape_html chunk.new_element}</strong></th>)
      end
    end
    [gen_indices, exp_indices, gen_headers, exp_headers, combined_headers]
  end
end
